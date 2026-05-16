import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, finalize, firstValueFrom, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PaymentConfig {
  keyId: string;
  defaultPlanId: string;
}

export interface SubscriptionResponse {
  id?: number;
  userId?: number;
  plan: string;
  status: string;
  razorpaySubId?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
}

export interface PaymentResponse {
  id: number;
  subscriptionId: number;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface RazorpayVerificationRequest {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  message: string;
  subscription: SubscriptionResponse;
  payment?: PaymentResponse;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (event: string, callback: (response: unknown) => void) => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}${environment.payment.baseUrl}`;
  private scriptLoading?: Promise<void>;
  private checkoutInProgress = false;

  config(): Observable<PaymentConfig> {
    return this.http.get<PaymentConfig>(`${this.apiUrl}/config`);
  }

  status(): Observable<SubscriptionResponse> {
    return this.http.get<SubscriptionResponse>(`${this.apiUrl}/status`).pipe(
      map(subscription => this.normalizeSubscription(subscription))
    );
  }

  payments(): Observable<PaymentResponse[]> {
    return this.http.get<PaymentResponse[]>(`${this.apiUrl}/payments`);
  }

  createSubscription(planId: string, totalCount = 12): Observable<SubscriptionResponse> {
    return this.http.post<SubscriptionResponse>(`${this.apiUrl}/create`, { planId, totalCount }).pipe(
      map(subscription => this.normalizeSubscription(subscription))
    );
  }

  cancelSubscription(razorpaySubId?: string): Observable<SubscriptionResponse> {
    return this.http.post<SubscriptionResponse>(`${this.apiUrl}/cancel`, { razorpaySubId });
  }

  verifyPayment(request: RazorpayVerificationRequest): Observable<PaymentVerificationResponse> {
    console.log('Razorpay verification request', request);
    return this.http.post<PaymentVerificationResponse>(`${this.apiUrl}/verify`, request).pipe(
      map(response => ({
        ...response,
        subscription: this.normalizeSubscription(response.subscription)
      }))
    );
  }

  startCheckout(): Observable<SubscriptionResponse> {
    return defer(() => {
      if (this.checkoutInProgress) {
        return throwError(() => new Error('Payment checkout is already open. Please complete or close it first.'));
      }

      this.checkoutInProgress = true;
      return this.config().pipe(
        map(config => {
          if (!config.keyId || !config.defaultPlanId) {
            throw new Error('Razorpay checkout is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_PRO_PLAN_ID.');
          }
          return config;
        }),
          switchMap(config => this.createSubscription(config.defaultPlanId).pipe(
            switchMap(subscription => this.openRazorpay(config, subscription))
          )),
        finalize(() => {
          this.checkoutInProgress = false;
        })
      );
    });
  }

  private async openRazorpay(config: PaymentConfig, subscription: SubscriptionResponse): Promise<SubscriptionResponse> {
    if (!config.keyId || !config.defaultPlanId) {
      throw new Error('Razorpay checkout is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_PRO_PLAN_ID.');
    }
    if (!subscription.razorpaySubId) {
      throw new Error('Missing Razorpay subscription id');
    }
    await this.loadRazorpay();

    return new Promise((resolve, reject) => {
      let settled = false;
      let paymentFailed = false;
      const checkout = new window.Razorpay!({
        key: config.keyId,
        name: 'ConnectHub Premium',
        description: 'PRO membership',
        subscription_id: subscription.razorpaySubId,
        theme: {
          color: '#10b981'
        },
        handler: async (response: any) => {
          console.log('PAYMENT SUCCESS', response);
          try {
            if (!response?.razorpay_payment_id || !response?.razorpay_subscription_id || !response?.razorpay_signature) {
              throw new Error('Razorpay did not return complete payment verification data.');
            }

            const verification = await firstValueFrom(this.verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature
            }));

            console.log('Razorpay verification response', verification);
            settled = true;

            if (!verification.success) {
              reject(new Error(verification.message || 'Payment verification failed.'));
              return;
            }

            resolve(verification.subscription);
          } catch (error: any) {
            console.error('Razorpay verification failed', error);
            settled = true;
            reject(new Error(error?.error?.message || error?.message || 'Payment verification failed.'));
          }
        },
        modal: {
          ondismiss: function () {
            console.log('Razorpay popup closed');
            if (!settled && !paymentFailed) {
              reject(new Error('Payment cancelled'));
            }
          }
        }
      });

      checkout.on?.('payment.failed', (response: any) => {
        console.error('Razorpay payment failed', response);
        paymentFailed = true;
        settled = true;
        reject(new Error(response?.error?.description || response?.error?.reason || 'Payment failed. Please try again.'));
      });

      checkout.open();
    });
  }

  private loadRazorpay(): Promise<void> {
    if (window.Razorpay) {
      return Promise.resolve();
    }
    if (this.scriptLoading) {
      return this.scriptLoading;
    }
    this.scriptLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = environment.payment.razorpay.checkoutUrl;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load Razorpay checkout'));
      document.head.appendChild(script);
    });
    return this.scriptLoading;
  }

  private normalizeSubscription(subscription: SubscriptionResponse): SubscriptionResponse {
    const startDate = subscription.startDate || subscription.createdAt;
    return {
      ...subscription,
      startDate,
      endDate: subscription.endDate || this.computeOneMonthEndDate(startDate)
    };
  }

  private computeOneMonthEndDate(startDate?: string): string | undefined {
    if (!startDate) {
      return undefined;
    }
    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    const end = new Date(parsed);
    end.setMonth(end.getMonth() + 1);
    return end.toISOString();
  }
}

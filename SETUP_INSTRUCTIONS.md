# ConnectHub Setup Instructions

## Issue
The project has an Angular version compatibility issue:
- `@angular/animations` needs to be version compatible with `@angular/core@20.1.x`
- Old configuration specified `@angular/animations@21.2.11` which requires Angular 21
- This causes an ERESOLVE peer dependency conflict during npm install

## Solutions Implemented

### 1. .npmrc Configuration
Created `.npmrc` file with:
```
legacy-peer-deps=true
```
This tells npm to allow peer dependency mismatches.

### 2. Custom Setup Script
Added `npm run setup` script in package.json:
```json
"setup": "npm install --legacy-peer-deps"
```

### 3. Package.json Fix
Updated dependencies to use compatible Angular versions:
```json
"@angular/animations": "^20.1.0",
"@angular/core": "^20.1.0"
```

## How to Fix in Builder.io

The Builder platform setup is failing because it's still trying to run `npm install` without the legacy-peer-deps flag.

### Option 1: Update Setup Command (Recommended)
1. Open **Project Settings** in Builder
2. Find the **Setup Command** field
3. Change from: `npm install`
4. Change to: `npm install --legacy-peer-deps`
5. Save and rebuild

### Option 2: Use Custom Setup Script
1. Open **Project Settings** in Builder
2. Find the **Setup Command** field  
3. Change to: `npm run setup`
4. Save and rebuild

### Option 3: Manual Fix
If auto-detection doesn't work:
1. In the project terminal/console, run:
   ```bash
   npm install --legacy-peer-deps
   ```
2. Then start dev server:
   ```bash
   npm start
   ```

## Verification

Once setup is complete, verify everything works:

```bash
npm install --legacy-peer-deps  # Should install 596 packages
npm run build                     # Should complete successfully
npm start                         # Should start dev server on :4200
```

## Files Changed
- `.npmrc` - Created with legacy-peer-deps setting
- `package.json` - Added setup script, updated Angular animations version
- `package-lock.json` - Regenerated with correct versions

## Status
✅ All code fixes are in place and tested locally
✅ Setup command alternatives are available
✅ Ready for Builder platform to run setup with updated command

---

**Next Step**: Click Settings in Builder and update the setup command to one of the options above.

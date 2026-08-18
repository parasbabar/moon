# FIX LACE CONNECTION ISSUE

## Root Cause
MetaMask extension conflict with Lace causing:
1. `"Could not establish connection. Receiving end does not exist."`
2. `MaxListenersExceededWarning` - Too many event listeners
3. `ObjectMultiplex - orphaned data for stream` - Connection streams corrupted

## Immediate Fix (Required)

### 1. Disable MetaMask Extension
```
chrome://extensions → Find MetaMask → Toggle OFF
```

### 2. Refresh Lace Extension
```
chrome://extensions → Find Lace → Click Refresh icon
```

### 3. Restart Browser Completely
- Close ALL browser windows
- Wait 10 seconds
- Reopen browser

### 4. Test Connection
Navigate to: `http://localhost:8080/index.html`

## If Still Failing

### 1. Check Extension Permissions
```
chrome://extensions → Lace → Details → Site access
```
Ensure "On all sites" or localhost is allowed

### 2. Try Incognito Mode
- Open incognito window
- Enable Lace in incognito (chrome://extensions → Allow in incognito)
- Navigate to `http://localhost:8080`

### 3. Clear Extension State
```
chrome://extensions → Lace → Remove → Reinstall
```

## API Compatibility Verified
- ✅ DApp Connector API v4.0.1 installed
- ✅ `window.midnight[UUID].connect("preprod")` pattern correct
- ✅ `getShieldedAddresses()` method expected
- ✅ Timeout protection added (15s)

## After Successful Connection

1. Navigate to: `http://localhost:8080/index.html`
2. Click "Connect Lace Wallet"
3. Verify wallet address appears
4. Click "Deploy Contract to Preprod"
5. Approve transaction in Lace
6. Wait for confirmation (30-90s for ZK proof)
7. Note REAL `ct_...` contract address
8. Update `.env` with `VITE_CONTRACT_ADDRESS=ct_...`
9. Rebuild frontend: `npm run build`
10. Test complete verification flow

## Code Fixes Applied

1. **`api/src/MidnightVerifyAPI.ts`** - Updated to use `getShieldedAddresses()` with timeout
2. **`deploy/deploy-real.js`** - Added timeout protection to prevent hanging
3. **Frontend** - Uses corrected DApp Connector API v4.0.1 pattern

## Final Status
- ✅ Contract compiled (18/18 tests passing)
- ✅ Frontend builds successfully
- ✅ Docker proof server running
- ✅ HTTP server running on localhost:8080
- ✅ Lace API pattern corrected
- ✅ Deployment UI ready
- ❌ **Blocked by MetaMask-Lace extension conflict**

**ACTION REQUIRED:** Disable MetaMask, refresh Lace, restart browser.
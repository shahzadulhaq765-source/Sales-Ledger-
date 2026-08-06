# Sales Ledger Android

A modern offline Android app for customer-wise and SKU-wise sales, tonnage, payments and outstanding balances.

## Included
- Manual customer entry
- User-defined SKU code (no automatic serial number)
- SKU name and code shown together
- Manual date-wise sales entry
- Automatic amount = tonnage × price
- Opening outstanding import
- Customer payments
- Automatic current outstanding
- Offline storage on the phone
- Modern Jetpack Compose UI

## Excel import format
Save your Excel sheet as **CSV UTF-8** with these columns:

Customer Code,Customer Name,Outstanding Amount
C001,Ahmed Traders,250000
C002,Ali Enterprises,175500

Open Android Studio, select this folder, allow Gradle sync, then Build > Build APK(s).

Minimum Android version: Android 8.0 (API 26).

## Build APK using GitHub Actions
1. Upload all project files, including the `.github` folder, to a GitHub repository.
2. Open the repository's **Actions** tab.
3. Open **Build Android APK** and choose **Run workflow**.
4. After the run succeeds, open it and download the **SalesLedger-APK** artifact.
5. Extract the downloaded artifact ZIP to get `app-debug.apk`.

# Sales Ledger Android

Modern offline Android app for customer-wise and SKU-wise sales, tonnage, payments and outstanding balances.

## GitHub se APK banana
1. Is ZIP ko extract karein.
2. Extracted folder ke andar ki **tamam files aur folders** GitHub repository ke root mein upload karein.
3. Repository mein `.github`, `app`, `build.gradle.kts`, `settings.gradle.kts` nazar aane chahiye.
4. GitHub ke **Actions** tab mein `Build Android APK` open karein.
5. `Run workflow` dabayen.
6. Green tick ke baad run open karke `SalesLedger-APK` artifact download karein.
7. Download ZIP extract karein; us ke andar `app-debug.apk` install karein.

## Features
- Manual customer entry
- Manual custom SKU code; auto serial numbering nahi
- SKU code aur SKU name dono show hote hain
- Date-wise sale entry
- Amount = tonnage × price
- Customer payments
- Opening outstanding CSV import
- Automatic outstanding calculation
- Offline phone storage

## Outstanding import
Excel file ko CSV UTF-8 mein save karein:

Customer Code,Customer Name,Outstanding Amount
C001,Ahmed Traders,250000
C002,Ali Enterprises,175500

Minimum Android version: Android 8.0.

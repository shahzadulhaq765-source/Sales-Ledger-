plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.suh.salespro"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.suh.salespro"
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "3.0"
    }
}
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
}

# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# M1 mobile security hardening — no hand-written -keep rules were added for the Capacitor
# plugins this app links (app, geolocation, haptics, keyboard, push-notifications,
# splash-screen, status-bar, capacitor-secure-storage-plugin). Evidence for why that's safe,
# checked before enabling minifyEnabled:
#
#  - @capacitor/android ships its OWN consumerProguardFiles entry (see
#    node_modules/@capacitor/android/capacitor/proguard-rules.pro), which AGP merges into every
#    app that depends on ':capacitor-android' automatically. It keeps every
#    `com.getcapacitor.Plugin` subclass in full (`-keep public class * extends
#    com.getcapacitor.Plugin { *; }`) plus the @CapacitorPlugin/@PluginMethod/@PermissionCallback/
#    @ActivityCallback-annotated members Capacitor's bridge dispatches via reflection. Every
#    plugin above is a `Plugin` subclass, so this already covers all of them.
#  - The one non-@capacitor plugin, capacitor-secure-storage-plugin, does not itself ship a
#    consumer proguard file, but its non-Plugin helper class (PasswordStorageHelper) selects its
#    SDK16/SDK18 implementation via a plain `new PasswordStorageHelper_SDK16()` /
#    `new PasswordStorageHelper_SDK18()` call, not reflection or Class.forName — R8's ordinary
#    call-graph analysis keeps both without help.
#
# Do not add a broad wildcard -keep for a new plugin without repeating this check first.

# Preserve line-number information in stack traces (needed to de-obfuscate a release crash
# against the R8 mapping.txt AGP writes to app/build/outputs/mapping/release/), while still
# hiding real source file paths from a decompiled/reverse-engineered release APK.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_ROOT="${ANDROID_HOME:-/home/xxx/Android/sdk}"
BUILD_TOOLS="${BUILD_TOOLS:-$SDK_ROOT/build-tools/34.0.0}"
PLATFORM_JAR="${PLATFORM_JAR:-$SDK_ROOT/platforms/android-34/android.jar}"
APP_ID="com.drlogo.app"
APP_NAME="dr-logo-native"

rm -rf "$ROOT/build/classes" "$ROOT/build/dex" "$ROOT/build/gen" "$ROOT/build/compiled" "$ROOT/build/package"
mkdir -p "$ROOT/build/classes" "$ROOT/build/dex" "$ROOT/build/gen" "$ROOT/build/compiled" "$ROOT/build/package" "$ROOT/dist"

"$BUILD_TOOLS/aapt2" compile --dir "$ROOT/res" -o "$ROOT/build/compiled/resources.zip"
"$BUILD_TOOLS/aapt2" link \
  -I "$PLATFORM_JAR" \
  --manifest "$ROOT/AndroidManifest.xml" \
  --java "$ROOT/build/gen" \
  -o "$ROOT/build/package/resources.apk" \
  "$ROOT/build/compiled/resources.zip"

javac -encoding UTF-8 -source 8 -target 8 \
  -classpath "$PLATFORM_JAR" \
  -d "$ROOT/build/classes" \
  $(find "$ROOT/build/gen" "$ROOT/src" -name '*.java' | sort)

"$BUILD_TOOLS/d8" \
  --lib "$PLATFORM_JAR" \
  --output "$ROOT/build/dex" \
  $(find "$ROOT/build/classes" -name '*.class' | sort)

cp "$ROOT/build/package/resources.apk" "$ROOT/dist/$APP_NAME-unsigned.apk"
(cd "$ROOT/build/dex" && zip -q "$ROOT/dist/$APP_NAME-unsigned.apk" classes.dex)

"$BUILD_TOOLS/zipalign" -f 4 "$ROOT/dist/$APP_NAME-unsigned.apk" "$ROOT/dist/$APP_NAME-aligned.apk"

if [ ! -f "$ROOT/build/debug.keystore" ]; then
  keytool -genkeypair -v \
    -keystore "$ROOT/build/debug.keystore" \
    -storepass android \
    -keypass android \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Android Debug,O=Dr Logo,C=US"
fi

"$BUILD_TOOLS/apksigner" sign \
  --ks "$ROOT/build/debug.keystore" \
  --ks-key-alias androiddebugkey \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$ROOT/dist/$APP_NAME.apk" \
  "$ROOT/dist/$APP_NAME-aligned.apk"

"$BUILD_TOOLS/apksigner" verify --verbose "$ROOT/dist/$APP_NAME.apk"
echo "Built: $ROOT/dist/$APP_NAME.apk"

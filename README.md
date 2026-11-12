# TONNA Mobile

Flutter-оболочка исходного `FreightMobilePrototype/index.html`, без бэкенда.
Исходный HTML не изменён: Android/iOS используют локальный WebView, Web — iframe.
Это не перенос экранов на нативные Flutter-виджеты.

## Запуск

```sh
flutter pub get
flutter run -d chrome
flutter run -d <device-id>
```

Для iOS необходимы macOS, Xcode, настройка signing и устройство/симулятор.
Для Android необходимы Android SDK и устройство/эмулятор.

## Проверки

`flutter analyze`, `flutter test`, `flutter build web` проходят.
Android debug APK собран: `build/app/outputs/flutter-apk/app-debug.apk`.
Для совместимости WebView используются AGP 8.13.2, Gradle 8.14.3 и Kotlin 2.3.0.
Установлен JDK 21 в `C:\Users\user\develop\jdk-21.0.13+9`; Flutter настроен
на него через `flutter config --jdk-dir`. В Android Studio выберите этот же
Gradle JDK в Settings → Build Tools → Gradle.
APK установлен и экран входа проверен на эмуляторе API 37.0.
Оконный эмулятор зависал; рабочий запуск — `-no-window -gpu swiftshader
-no-snapshot -feature -Vulkan -cores 2`. Его можно выбрать как emulator-5554.
Снимок экрана: `tonna-android.png`. Полный сценарный тест ещё не выполнен.
iOS на Windows не собирался.

## Поведение

- HTML и изображения включены в bundle, загрузка интерфейса не требует сети.
- Данные живут только в памяти WebView и сбрасываются после перезапуска.
- Android back возвращается по истории HTML, затем закрывает приложение.
- Ссылки https://2gis.ru открываются внешним приложением по нажатию.
- Выбор файлов обрабатывается WebView платформы. Реальные устройства ещё
  не проверены: выбор нескольких фото, CMR, клавиатура, safe areas, жесты,
  VoiceOver/TalkBack и открытие 2ГИС требуют тестирования Android/iOS.
- Совместимость со всеми моделями устройств не гарантирована без тестирования.
- Перед публикацией нужны собственные applicationId/bundle ID, иконки и release signing.

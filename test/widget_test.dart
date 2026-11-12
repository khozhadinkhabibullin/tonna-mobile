import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Original prototype and images are bundled for offline use', () async {
    final html = await rootBundle.loadString(
      'FreightMobilePrototype/index.html',
    );
    expect(html, contains('<title>Грузовой кабинет</title>'));
    expect(html, contains('id="mapLink"'));
    for (final name in ['profile-portrait.webp', 'vehicle-truck.webp']) {
      final bytes = await rootBundle.load(
        'FreightMobilePrototype/assets/$name',
      );
      expect(bytes.lengthInBytes, greaterThan(0));
    }
  });
}

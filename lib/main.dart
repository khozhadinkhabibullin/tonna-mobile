import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'prototype_mobile.dart'
    if (dart.library.js_interop) 'prototype_web.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Color(0xff17191b),
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Color(0xff17191b),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const TonnaApp());
}

class TonnaApp extends StatelessWidget {
  const TonnaApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'TONNA',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(scaffoldBackgroundColor: const Color(0xff17191b)),
    home: const Scaffold(body: SafeArea(child: PrototypeView())),
  );
}

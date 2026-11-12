import 'dart:ui_web' as ui_web;

import 'package:flutter/widgets.dart';
import 'package:web/web.dart' as web;

class PrototypeView extends StatefulWidget {
  const PrototypeView({super.key});

  @override
  State<PrototypeView> createState() => _PrototypeViewState();
}

class _PrototypeViewState extends State<PrototypeView> {
  static int _nextId = 0;
  late final String _viewType;

  @override
  void initState() {
    super.initState();
    _viewType = 'tonna-prototype-${_nextId++}';
    ui_web.platformViewRegistry.registerViewFactory(_viewType, (id) {
      return web.HTMLIFrameElement()
        ..src = 'assets/FreightMobilePrototype/index.html'
        ..title = 'Грузовой кабинет TONNA'
        ..style.border = '0'
        ..style.width = '100%'
        ..style.height = '100%';
    });
  }

  @override
  Widget build(BuildContext context) => HtmlElementView(viewType: _viewType);
}

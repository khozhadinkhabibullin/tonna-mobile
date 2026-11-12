import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';

class PrototypeView extends StatefulWidget {
  const PrototypeView({super.key});

  @override
  State<PrototypeView> createState() => _PrototypeViewState();
}

class _PrototypeViewState extends State<PrototypeView> {
  InAppWebViewController? _controller;
  bool _loading = true;
  bool _failed = false;

  Future<void> _external(WebUri? url) async {
    final uri = Uri.tryParse(url?.toString() ?? '');
    if (uri == null || uri.scheme != 'https' || uri.host != '2gis.ru') {
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Не удалось открыть 2ГИС')));
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, result) async {
      if (didPop) return;
      final controller = _controller;
      if (controller != null && await controller.canGoBack()) {
        await controller.goBack();
      } else {
        await SystemNavigator.pop();
      }
    },
    child: Stack(
      children: [
        InAppWebView(
          initialFile: 'FreightMobilePrototype/index.html',
          initialSettings: InAppWebViewSettings(
            javaScriptEnabled: true,
            useShouldOverrideUrlLoading: true,
            supportMultipleWindows: true,
            javaScriptCanOpenWindowsAutomatically: false,
            disableContextMenu: false,
            supportZoom: true,
            isInspectable: false,
          ),
          onWebViewCreated: (controller) => _controller = controller,
          onLoadStop: (controller, url) {
            if (mounted) setState(() => _loading = false);
          },
          onReceivedError: (controller, request, error) {
            if (request.isForMainFrame == true && mounted) {
              setState(() {
                _failed = true;
                _loading = false;
              });
            }
          },
          shouldOverrideUrlLoading: (controller, action) async {
            final url = action.request.url;
            if (url?.scheme == 'https' || url?.scheme == 'http') {
              await _external(url);
              return NavigationActionPolicy.CANCEL;
            }
            return NavigationActionPolicy.ALLOW;
          },
          onCreateWindow: (controller, action) async {
            await _external(action.request.url);
            return false;
          },
        ),
        if (_loading)
          const ColoredBox(
            color: Color(0xff17191b),
            child: Center(
              child: CircularProgressIndicator(color: Color(0xffff5c19)),
            ),
          ),
        if (_failed)
          ColoredBox(
            color: const Color(0xfff2f0e9),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Не удалось загрузить приложение'),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _failed = false;
                        _loading = true;
                      });
                      _controller?.loadFile(
                        assetFilePath: 'FreightMobilePrototype/index.html',
                      );
                    },
                    child: const Text('Повторить'),
                  ),
                ],
              ),
            ),
          ),
      ],
    ),
  );
}

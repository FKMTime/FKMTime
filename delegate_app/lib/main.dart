import 'package:delegate_app/homepage.dart';
import 'package:delegate_app/login.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'incident.dart';


void main() async {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'FKM Time',
      theme: ThemeData(
        colorScheme: const ColorScheme.dark(
          primary: Colors.white70,
        ),
        useMaterial3: true,
      ),
      routerConfig: GoRouter(
        routes: routes,
      ),
    );
  }
}

final routes = [
  GoRoute(
    path: "/",
    builder: (context, state) => HomePage(),
  ),
  GoRoute(
    path: "/login",
    pageBuilder: (context, state) => defaultTransitionPage(
      context,
      state,
      LoginPage(),
    ),
  ),
  GoRoute(
    path: "/incidents/:caseId",
    pageBuilder: (context, state) => defaultTransitionPage(
      context,
      state,
      IncidentPage(caseId: state.pathParameters['caseId']!),
    ),
  ),
];

Page defaultTransitionPage(
    BuildContext context, GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    transitionDuration: const Duration(milliseconds: 300),
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(
        opacity: CurveTween(curve: Curves.easeIn).animate(animation),
        child: child,
      );
    },
  );
}

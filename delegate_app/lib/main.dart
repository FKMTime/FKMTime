import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:delegate_app/pages/settings.dart';
import 'package:delegate_app/pages/homepage.dart';
import 'package:delegate_app/pages/incident.dart';
import 'package:delegate_app/pages/login.dart';
import 'package:delegate_app/pages/results.dart';
import 'package:delegate_app/pages/rounds.dart';
import 'package:delegate_app/pages/result.dart';


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
    path: "/rounds",
    pageBuilder: (context, state) => defaultTransitionPage(
      context,
      state,
      RoundsPage(),
    ),
  ),
    GoRoute(
    path: "/settings",
    pageBuilder: (context, state) => defaultTransitionPage(
      context,
      state,
      const SettingsPage(),
    ),
  ),
  GoRoute(
    path: "/rounds/:roundId",
    pageBuilder: (context, state) => defaultTransitionPage(
      context,
      state,
      ResultsPage(roundId: state.pathParameters['roundId']!),
    ),
  ),
  GoRoute(
    path: "/results/:resultId",
    pageBuilder: (context, state) => defaultTransitionPage(
      context,
      state,
      ResultPage(resultId: state.pathParameters['resultId']!),
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

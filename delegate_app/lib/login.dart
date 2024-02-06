import 'package:delegate_app/main.dart';
import 'package:delegate_app/types.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class LoginPage extends StatelessWidget {
  LoginPage({super.key});

  var usernameController = TextEditingController();
  var passwordController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                decoration: const InputDecoration(
                  hintText: "Login",
                  border: OutlineInputBorder(),
                ),
                controller: usernameController,
              ),
              const SizedBox(height: 10),
              TextField(
                decoration: const InputDecoration(
                  hintText: "Password",
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
                controller: passwordController,
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () async {
                  if (usernameController.text == "" || passwordController.text == "") {
                    return;
                  }
                  final user = await User.login(usernameController.text, passwordController.text);
                  await user.saveToken();
                  await GoRouter.of(context).replace("/");
                },
                style: const ButtonStyle(
                  backgroundColor: MaterialStatePropertyAll(Colors.white70),
                  foregroundColor: MaterialStatePropertyAll(Colors.black),
                ),
                child: const Text("Login"),
              ),
              const SizedBox(height: 300),
            ],
          ),
        ),
      ),
    );
  }
}

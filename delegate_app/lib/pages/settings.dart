import 'package:delegate_app/api/group.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:delegate_app/api/user.dart';
import 'package:delegate_app/components/loading.dart';
import 'package:fluttertoast/fluttertoast.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPage();
}

class _SettingsPage extends State<SettingsPage> {
  String currentGroupId = '';

  Future<void> handleSubmit() async {
    final ok = await Group.updateCurrentGroup(currentGroupId);
    if (ok) {
      context.go('/');
    } else {
        Fluttertoast.showToast(
        msg: "Something went wrong!",
        toastLength: Toast.LENGTH_SHORT,
        gravity: ToastGravity.CENTER,
        timeInSecForIosWeb: 1,
        backgroundColor: Colors.red,
        textColor: Colors.white,
        fontSize: 16.0
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: () async {
        final token = await User.getToken() != null;
        if (token) {
          return Group.fetchAllGroups();
        } else {
          return [];
        }
      }(),
      builder: _build,
    );
  }

  Widget _build(BuildContext context, AsyncSnapshot snapshot) {
    if (snapshot.hasError) {
      String err = snapshot.error.toString();
      return Scaffold(body: Text('An error occurred $err'));
    }
    if (!snapshot.hasData) {
      return const Loading();
    }

    List<DropdownMenuItem<String>> items = [];
    for (Group group in snapshot.data) {
      items.add(DropdownMenuItem(
        value: group.groupId,
        child: Text(group.name),
      ));
      if (group.isCurrent && currentGroupId.isEmpty) {
        currentGroupId = group.groupId;
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('FKM Time'),
        actions: [
          IconButton(
            onPressed: () async {
              context.go('/');
            },
            icon: const Icon(Icons.home),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(10),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Current group',
              style: TextStyle(fontSize: 18, color: Colors.white),
            ),
            DropdownButton<String>(
              value: currentGroupId,
              onChanged: (String? value) {
                setState(() {
                  currentGroupId = value!;
                });
              },
              items: items,
            ),
            const SizedBox(height: 10),

            const SizedBox(height: 20),
            // Save button
            ElevatedButton(
              onPressed: handleSubmit,
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }
}

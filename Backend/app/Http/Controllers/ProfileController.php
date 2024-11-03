<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Http\Request;
use App\Models\Kelas;

class ProfileController extends Controller
{
    public function index()
    {
        $user = auth()->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        try {
            switch ($user->level_id) {
                case 1:
                    $data = [
                        'username' => $user->username,
                        'nama' => $user->nama,
                        'level' => 'Administrator'
                    ];
                    break;
                case 2:
                    $data = [
                        'username' => $user->username,
                        'nama' => $user->nama,
                        'kelas' => $user->class->class ?? null,
                        'Level' => 'Teacher'
                    ];
                    break;
                case 3:
                    $data = [
                        'username' => $user->username,
                        'nama' => $user->nama,
                        'nis' => $user->nis,
                        'kelas' => $user->class->class ?? null,
                        'Level' => 'Student'
                    ];
                    break;
                default:
                    return response()->json(['message' => 'Invalid user level'], 400);
            }

            return response()->json(['message' => 'success', 'data' => $data], 200);
        } catch (Exception $e) {
            return response()->json(['message' => 'failed', 'error' => $e->getMessage()], 500);
        }
    }

    public function change(Request $req)
    {
        $user = auth()->user();

        if(!empty($user)){
            $req->validate([
                'password' => 'required|string|min:8',
                'username' => 'required|string|max:255',
                'profile' => 'nullable|string',
            ]);

            $user->update([
                'password' => password_hash($req->input('password')),
                'username' => $req->input('username'),
                'profile' => $req->input('profile')]);
            return response()->json(['message' => 'Profile updated successfully'], 200);
        }
        else{
            return response()->json(['message' => 'Unauthorized'], 401);
        }
    }
}
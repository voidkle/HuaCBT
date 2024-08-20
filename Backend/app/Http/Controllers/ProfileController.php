<?php

namespace App\Http\Controllers;

use Exception;
use Illuminate\Http\Request;

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
                        'kelas' => $user->kelas_id->name ?? null,
                        'Level' => 'Guru'
                    ];
                    break;
                case 3:
                    $data = [
                        'username' => $user->username,
                        'nama' => $user->nama,
                        'nis' => $user->nis,
                        'kelas' => $user->kelas_id->name ?? null,
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

    public function change()
    {
        $user = auth()->user();
    }
}
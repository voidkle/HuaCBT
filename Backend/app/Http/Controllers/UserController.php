<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Users;

class UserController extends Controller
{
    public function user_id() {
        $user = JWTAuth::user();
        if(!user){
            return response()->json(['message' => 'Forbidden'], 403);
        }
        else{
            return response()->json($user);
        }
    }
}

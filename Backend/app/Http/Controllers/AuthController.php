<?php

namespace App\Http\Controllers;

use Exception;
use App\Models\Users;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Tymon\JWTAuth\Exceptions\JWTException;

class AuthController extends Controller
{
    protected function validator(Request $req)
    {
        if (empty($req->username) && empty($req->password)) {
            return ['error' => 'Username and Password are required', 'status' => 401];
        }

        if (empty($req->username)) {
            return ['error' => 'Username is required', 'status' => 401];
        }

        if (empty($req->password)) {
            return ['error' => 'Password is required', 'status' => 401];
        }

        return null;
    }

    public function register(Request $req){
        $user = JWTAuth::user();
        if($user === null){
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        else if($user->level_id !== 1) {
            return  response()->json(['message' => 'Unauthorized'], 403);
        }
        else{
            $creds = $req->validate([
                'username' => 'required|string|unique:users',
                'kelas_id' => 'required|numeric',
                'nis' => 'required|numeric',
                'password' => 'required|string',
                'level_id' => 'required|numeric',
                'nama' => 'required|string'
            ]);
            DB::insert('insert into users (
            username, nama, nis, password, kelas_id, level_id, created_at, updated_at) values (?, ?, ?, ?, ?,?,?,?)', 
            [
                $creds['username'],
                $creds['nama'],
                $creds['nis'],
                password_hash($creds['password'], PASSWORD_DEFAULT),
                $creds['kelas_id'],
                $creds['level_id'],
                now(),
                now()
            ]);
            return response()->json(['message'=>'User successfully created!'], 200);
        }
    }

    public function login(Request $req)
    {
        $vlid = $this->validator($req);

        if ($vlid) {
            return response()->json($vlid, 401);
        }

        $creds = $req->only('username', 'password');
        try {
            if (! $token = JWTAuth::attempt($creds)) {
                return response()->json(['error' => 'invalid_credentials'], 401);
            }
        } catch (JWTException $e) {
            return response()->json(['error' => 'could_not_create_token'], 500);
        }
        $token = JWTAuth::attempt($creds);
        return response()->json(compact('token'));
    }

    public function logout(Request $req)
    {
        
        $token = JWTAuth::getToken();
        $logout = JWTAuth::invalidate($token);
        return response()->json(['message' => 'Successfully logged out']);
    }

    public function user()
    {
        $user = auth()->user();
        try {
            if (! $user = JWTAuth::parseToken()->authenticate()) {
                return response()->json(['message' => 'User not found'], 404);
            }
        } 
        catch(Exception $e){
            if($e instanceof Tymon\JWTAuth\Exceptions\TokenBlacklistedException){
                return response()->json(['message' => 'Token blacklisted'], 422);
            }
            else if($e instanceof Tymon\JWTAuth\Exceptions\TokenExpiredException){
                return response()->json(['message' => 'Token expired'], 401);
            }
            else if($e instanceof Tymon\JWTAuth\Exceptions\TokenInvalidException){
                return response()->json(['message' => 'Token invalid'], 401);
            }
            return response()->json(['message' => 'Token Absent'], 422);
        }
        return response()->json(compact('user'));
    }
}

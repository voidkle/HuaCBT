<?php

namespace App\Http\Controllers;

use Exception;
use App\Models\Users;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Tymon\JWTAuth\Exceptions;

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
            return response()->json([$vlid], 401);
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
        DB::table('user_activity')->insert([
            'user_id' => auth()->id(),
            'login_at' => now()
        ]);
        return response()->json(compact('token'));
    }

    public function logout(Request $req)
    {
        auth()->logout(true);

        DB::table('user_activity')
        ->where('user_id', auth()->id())
        ->whereNull('logout_at')
        ->update(['logout_at' => now()]);

        return response()->json(['message' => 'Successfully logged out']);
    }

    public function user()
    {
        $user = JWTAuth::user();
        try {
            if (!$user = JWTAuth::parseToken()->authenticate()) {
                return response()->json(['message' => 'Not logged in'], 401);
            }
        } 
        catch(Exception $e){
            if($e instanceof TokenBlacklistedException){
                return response()->json(['message' => 'Token blacklisted'], 422);
            }
            else if($e instanceof TokenExpiredException){
                return response()->json(['message' => 'Token expired'], 401);
            }
            else if($e instanceof TokenInvalidException){
                return response()->json(['message' => 'Token invalid'], 401);
            }
            return response()->json(['message' => 'Token Absent'], 422);
        }
        return response()->json(compact('user'));
    }

    public function loginStats(){
        $userActivities = DB::table('user-activity')->get();
        // Process data + aggregating the data to calculate login statistics :P
        $stats = [];

        foreach ($userActivities as $activity) {
            $userId = $activity->user_id;
            $loginTime = $activity->login_time;
            $logoutTime = $activity->logout_time;

            $duration = null;
            if ($logoutTime) {
                $duration = strtotime($logoutTime) - strtotime($loginTime);
            }

            if (!isset($stats[$userId])) {
                $stats[$userId] = [
                    'total_sessions' => 0,
                    'total_time_logged_in' => 0,
                ];
            }

            $stats[$userId]['total_sessions'] += 1;
            $stats[$userId]['total_time_logged_in'] += $duration ?? 0;
        }
        return response()->json($stats);
    }

    public function phptest(Request $r){
        if(Auth::check() == true){
        $p = auth()->id();
        return response()->json($p);
        }
        else{
            return 'kanjut';
        }
    }
}

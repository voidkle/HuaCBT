<?php

namespace App\Http\Middleware;

use Closure;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Admin
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = JWTAuth::user();
        if($user === null){
            return response()->json(['message'=>'Unauthorized'], 403);
        }
        else if($user->level_id !== 1){
            return response()->json(['message'=>'Unauthorized'],403);
        }
        else {
            return $next($request);
        }
    }
}

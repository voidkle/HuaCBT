<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function index(){
        // Showing all student data
        $user = DB::select("SELECT * FROM users WHERE level_id = ?", [3]);
        return response()->json($user);
    }
    public function session_ujian(){
        
    }
    public function ujian(){

    }
}

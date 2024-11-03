<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function list(){
        // Showing all student data
        $t = DB::table('tests')->get();
        return response()->json(['message' => 'Okay', 'data' => $t]);
    }
    public function session_ujian(){
        
    }
    public function ujian($id){
        $t = DB::select('select * from "tests" where level_id $id');
        return response()->json(['message' => 'Okay', 'data' => $t]);
    }
    public function class($id){
        $u = DB::table('users')
            ->join('classes', 'users.class_id', '=', 'classes.id')
            ->where('users.user_id', $id)
            ->select('classes.class')
            ->get();
        return response()->json(['message' => 'Okay', 'data' => $u]);
    }
}
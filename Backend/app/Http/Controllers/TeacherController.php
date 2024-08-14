<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class TeacherController extends Controller
{
    // add to question bank
    public function addQuestion(Request $req){
        $creds = $req->validate([
            '' => '',
            '' => '',
            
        ]);
    }

    public function addAnswer(Request $req){
        
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class TeacherController extends Controller
{
    public function addTest(Request $req){
        $creds = $req->validate([
            'testName' => 'required|string',
            'mapel' => 'required|string',
            'pengupload' => 'required|string',
            'test_id' => 'required',
            'kelas' => 'required',
        ]);
    }
    // add to question bank
    public function addQuestion(Request $req){
        $creds = $req->validate([
            'test_id' => 'required',
            'soal_id' => 'required',
            'soal' => 'string|required',
            'lampiran' => 'string|required',
        ]);
        DB::table('question_test')->insert($creds);
    }

    public function addAnswer(Request $req){
        $creds = $req->validate([
            'answer_id' => 'required',
            'question_id' => 'required',
            'true' => 'enum|required',
            'jawaban' => 'string|required',
        ]);
    }
    public function token(Request $req){
        $min = $req->minutes ?? 5;
        $tkn = str_pad(rand(0,99999), 5, '0', STR_PAD_LEFT);
        $exp = now()->addMinutes($min);
        DB::table('tokens')->insert([
            'token' => $tok,
            'expires_at' => $exp
        ]);
    }
    private function schedule($min){
        
    }
}  

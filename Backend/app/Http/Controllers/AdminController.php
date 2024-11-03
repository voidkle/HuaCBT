<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function index(){
        $u = DB::table('users')->where('level_id', 1)->get();
        if(empty($u)){
            return response()->json(["data" => 0,"message" => "Achievement : How did we get here?"], 200);
        }
        return response()->json(["message" => "Succesfully retrieved","data" => $u],200);
        
    }

    public function delete($id){
        $u = DB::select('select * from users where id = ?', [$id]);
        if(empty($u)){
            return response()->json(["data" => 0, "message" => "No Users"], 200);
        }
        else{
        DB::delete('delete from users where id = ?', [$id]);
        return response()->json(["data" => 1, "message" => "User deleted successfully"], 200);
        }
    }

    public function adminindex(){
        $u =  auth()->user();
        return response()->json([$u]);
    }
}

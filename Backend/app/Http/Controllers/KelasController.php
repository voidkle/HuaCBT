<?php

namespace App\Http\Controllers;

use App\Models\Kelas;
use Illuminate\Http\Request;

class KelasController extends Controller
{
    public function index()
    {
        $k = DB::table('classes')->get();
        return response()->json(['message' => 'Data fetched','data' => $k]);
    }

    public function store(Request $req)
    {
        return response()->json($req);
        // $k = DB::table('')->insert([
            
        // ]);
    }

    public function update(Request $request, $id)
    {
        $kelas = Kelas::findOrFail($id)->update($request->all());
        return response()->json($kelas);
    }

    public function delete($id)
    {
        $kelas = Kelas::findOrFail($id)->delete();
        return response()->json($kelas);
    }
}

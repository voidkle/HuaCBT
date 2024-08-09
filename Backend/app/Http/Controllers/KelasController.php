<?php

namespace App\Http\Controllers;

use App\Models\Kelas;
use Illuminate\Http\Request;

class KelasController extends Controller
{
    public function index()
    {
        $kelas = Kelas::all();
        return response()->json($kelas);
    }

    public function store(Request $request)
    {
        $kelas = Kelas::create($request->all());
        return response()->json($kelas);
    }

    public function show($id)
    {
        $kelas = Kelas::findOrFail($id);
        return response()->json($kelas);
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

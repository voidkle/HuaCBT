<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\UserController;
use App\Http\Controllers\KelasController;
use App\Http\Controllers\AuthController;

// All Users & Guests API
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);

Route::middleware(['admin'])->group(function () {
    // Admin only
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/kelas', [KelasController::class, 'store']);
    Route::put('/kelas/{id}', [KelasController::class, 'update']);
    Route::delete('/kelas/{id}', [KelasController::class, 'delete']);
});
Route::middleware(['auth'])->group(function () {
    // All Users Granted this http request lol
    Route::get('/kelas/{id}', [KelasController::class, 'show']);
    Route::get('/dashboard', [UserController::class, 'user_id']);
});

Route::middleware(['teacher'])->group(function () {
    // Admin & Teacher only
    Route::get('/kelas', [KelasController::class, 'index']);
});
Route::middleware(['student'])->group(function () {
    // Student only
    Route::get('/ujian/{id_ujian}/{session}',[StudentController::class,'session_ujian']);
    Route::get('/ujian/{id_ujian}',[StudentController::class,'ujian']);
});



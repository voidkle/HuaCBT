<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\UserController;
use App\Http\Controllers\KelasController;
use App\Http\Controllers\AuthController;

// All Users & Guests API
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);
Route::post('/phptest',[AuthController::class, 'phptest']);

Route::middleware(['auth'])->group(function () {
    Route::prefix('dashboard')->group(function(){
        Route::middleware(['admin'])->group(function () {
            // Admin only
            Route::prefix('admin')->group(function(){
                Route::post('/register', [AuthController::class, 'register']);
                Route::prefix('dashboard')->group(function (){
                    Route::get('/', [DashboardController::class, 'adminindex']);
                    Route::prefix('kelas')->group(function (){
                        Route::get('/',[KelasController::class, 'index']);
                        Route::post('/', [KelasController::class, 'store']);
                        Route::put('/{id}', [KelasController::class, 'update']);
                        Route::delete('/{id}', [KelasController::class, 'delete']);
                    });
                });
            });
        });
        Route::prefix('ujian')->group(function (){

        });
    });
});



Route::middleware(['teacher'])->group(function () {
    // Admin & Teacher only
    Route::get('/kelas', [KelasController::class, 'index']);
});
Route::middleware(['student'])->group(function () {
    // Student only
    Route::prefix('ujian')->group(function (){
        Route::get('/{id_ujian}/{session}',[StudentController::class,'session_ujian']);
        Route::get('/{id_ujian}',[StudentController::class,'ujian']);
    });
});



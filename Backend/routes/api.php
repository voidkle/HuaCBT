<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\UserController;
use App\Http\Controllers\KelasController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProfileController;

// All Users & Guests API
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);
Route::post('/phptest',[AuthController::class, 'phptest']);

Route::middleware(['allauth'])->group(function () {
    Route::prefix('profile')->group(function(){
        Route::get('user',[ProfileController::class, 'index']);
        Route::put('user',[ProfileController::class, 'change']);
        Route::post('user',[ProfileController::class, 'profile']);
    });
    Route::prefix('dashboard')->group(function(){
        Route::middleware(['student'])->group(function(){
            Route::prefix('ujian')->group( function(){
                Route::get('/{id_ujian}/{session}',[StudentController::class,'session_ujian']);
                Route::get('/{id_ujian}',[StudentController::class,'ujian']);
            });
            Route::get('class',[KelasController::class, 'studentindex']);
        });
        Route::middleware(['teacher'])->group(function () {
            // Admin & Teacher only
            Route::get('/classes', [KelasController::class, 'index']);
            Route::prefix('ujian')->group(function(){
                Route::get('token',[TeacherController::class, 'token']);
                Route::post('add-test',[TeacherController::class, 'addtest']);
                Route::put('edit-test',[TeacherController::class, 'edittest']);
                Route::delete('delete-test',[TeacherController::class, 'deletetest']);
            });
        });
        Route::middleware(['admin'])->group(function () {
            // Admin only
            Route::prefix('admin')->group(function(){
                Route::post('/register', [AuthController::class, 'register']);          
                Route::get('/', [DashboardController::class, 'adminindex']);
                Route::prefix('class')->group(function (){
                    Route::get('/',[KelasController::class, 'index']);
                    Route::post('/', [KelasController::class, 'store']);
                    Route::put('/{id}', [KelasController::class, 'update']);
                    Route::delete('/{id}', [KelasController::class, 'delete']);
                });
            });
        });
    });
});

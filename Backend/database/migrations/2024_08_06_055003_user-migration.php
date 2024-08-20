<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username');
            $table->string('nis');
            $table->string('nama');
            $table->unsignedBigInteger('class_id');
            $table->unsignedBigInteger('user_id')->unique();
            $table->string('password');
            $table->unsignedBigInteger('level_id');
            $table->timestamps();
            $table->foreign('class_id')->references('class_id')->on('classes');
            $table->foreign('level_id')->references('level_id')->on('level');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};

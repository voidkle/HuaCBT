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
            $table->unsignedBigInteger('kelas_id');
            $table->string('password');
            $table->unsignedBigInteger('level_id');
            $table->timestamps();
            $table->foreign('kelas_id')->references('id')->on('kelas');
            $table->foreign('level_id')->references('id')->on('level');
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

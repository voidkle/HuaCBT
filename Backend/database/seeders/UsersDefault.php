<?php

namespace Database\Seeders;

use App\Models\Users;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;

class UsersDefault extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('level')->insert([
            ['level_id' => 1, 'level' => 'Admin', 'created_at' => now(), 'updated_at' => now()],
            ['level_id' => 2, 'level' => 'Guru', 'created_at' => now(), 'updated_at' => now()],
            ['level_id' => 3, 'level' => 'Peserta', 'created_at' => now(), 'updated_at' => now()]
        ]);

        DB::table('classes')->insert([
            'class_id' => 1,
            'class' => 'Kelas Default 0',
            'created_at' => now(),
            'updated_at' => now()
        ]);
        DB::table('classes')->insert([
            'class_id' => 2,
            'class' => 'Kelas Default 1',
            'created_at' => now(),
            'updated_at' => now()
        ]);

        Users::create([
            'username' => 'fuhua',
            'user_id' => 1,
            'password' => password_hash('admin',PASSWORD_DEFAULT),
            'nis' => 1232,
            'level_id' => 1, // Admin level
            'class_id' => 1, // Default class id
            'nama' => 'Administrator'
        ]);
    }
}
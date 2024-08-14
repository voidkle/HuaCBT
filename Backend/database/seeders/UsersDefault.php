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

        DB::table('kelas')->insert([
            'kelas_id' => 1,
            'nama_kelas' => 'Kelas Default',
            'created_at' => now(),
            'updated_at' => now()
        ]);

        Users::create([
            'username' => 'admin',
            'password' => password_hash('admin',PASSWORD_DEFAULT),
            'nis' => 1232,
            'level_id' => 1, // Admin level
            'kelas_id' => 1, // Default class id
            'nama' => 'Administrator'
        ]);
    }
}
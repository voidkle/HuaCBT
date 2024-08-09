<?php

namespace Database\Seeders;

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
        DB::insert('insert into level (level_id, level, created_at, updated_at) values (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)', 
        [1, 'Admin', now(), now()],
        [2, 'Guru', now(), now()],
        [3, 'Peserta', now(), now()]
        );
        DB::insert('insert into kelas (kelas_id, nama_kelas, created_at, updated_at) values (?, ?, ?, ?)',
        [1, 'Kelas Default', now(), now()]);
        Users::create([
            'username' => 'admin',
            'password' => password_hash('admin', PASSWORD_DEFAULT),
            'nis' => 1232,
            'level_id' => 1, // Admin level
            'kelas_id' => 1, // Default class id
            'nama' => 'Administrator'
        ]);
    }
}

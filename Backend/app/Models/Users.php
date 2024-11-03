<?php

namespace App\Models;

use App\Models\Kelas;
use Tymon\JWTAuth\Contracts\JWTSubject;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Users extends Authenticatable implements JWTSubject
{
    use HasFactory;

    protected $table = 'users';

    public function class(){
        return $this->belongsTo(Kelas::class, 'class_id');
    }
    
    protected $fillable = ['username', 'nama','nis', 'kelas_id', 'password', 'level_id'];

    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     *
     * @return array
     */
    public function getJWTCustomClaims()
    {
        return [];
    }
}

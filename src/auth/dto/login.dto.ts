import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'librarian@university.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Librarian@123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

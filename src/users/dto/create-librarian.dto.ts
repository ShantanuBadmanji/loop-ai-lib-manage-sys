import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLibrarianDto {
  @ApiProperty({ example: 'Grace Hopper' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'grace@university.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Librarian@123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'EMP-1001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  employeeNumber: string;
}

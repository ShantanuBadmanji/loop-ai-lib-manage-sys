import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LookupStudentDto {
  @ApiPropertyOptional({
    example: 'alice@university.edu',
    description: 'Look up by email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'ENR-2024-001',
    description: 'Look up by enrollment number (from student ID card)',
  })
  @IsOptional()
  @IsString()
  enrollmentNumber?: string;
}

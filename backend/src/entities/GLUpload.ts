import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class GLUpload {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  fileName!: string;
}

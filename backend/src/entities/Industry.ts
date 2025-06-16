import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Industry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}

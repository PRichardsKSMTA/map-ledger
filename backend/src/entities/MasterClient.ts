import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class MasterClient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}

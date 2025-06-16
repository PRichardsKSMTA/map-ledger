import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class MappingSuggestion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  description!: string;
}

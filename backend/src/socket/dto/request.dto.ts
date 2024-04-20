export interface RequestDto<T> {
  type: string;
  tag: number;
  data: T;
}

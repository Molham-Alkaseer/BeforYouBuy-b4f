import { CreateCategoryDto } from './create-category.dto';

// Name is the only editable field, so an empty PATCH is invalid.
export class UpdateCategoryDto extends CreateCategoryDto {}

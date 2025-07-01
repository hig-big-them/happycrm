import { z } from "zod";

export const CreateAgencyUserSchema = z.object({
  email: z.string().email({ message: "Geçerli bir e-posta adresi girin." }),
  password: z.string().min(8, { message: "Şifre en az 8 karakter olmalıdır." }),
  agencyName: z.string().min(3, { message: "Ajans adı en az 3 karakter olmalıdır." }),
  username: z
    .string()
    .min(3, { message: "Kullanıcı adı en az 3 karakter olmalıdır." })
    .max(50, { message: "Kullanıcı adı en fazla 50 karakter olabilir." })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "Kullanıcı adı sadece harf, rakam ve alt çizgi (_).",
    })
    .toLowerCase()
    .trim(),
});

// Diğer action şemaları buraya eklenebilir... 
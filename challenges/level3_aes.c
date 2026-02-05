#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <openssl/aes.h>
#include <openssl/evp.h>

// Hardcoded AES-256 key and IV (32 bytes key, 16 bytes IV)
// Key: "MySecretKey123456789012345678901" (32 bytes)
// IV:  "InitVector123456" (16 bytes)
const unsigned char AES_KEY[] = "MySecretKey123456789012345678901";
const unsigned char AES_IV[] = "InitVector123456";

int aes_encrypt(unsigned char *plaintext, int plaintext_len, 
                unsigned char *key, unsigned char *iv,
                unsigned char *ciphertext) {
    EVP_CIPHER_CTX *ctx;
    int len;
    int ciphertext_len;
    
    ctx = EVP_CIPHER_CTX_new();
    EVP_EncryptInit_ex(ctx, EVP_aes_256_cbc(), NULL, key, iv);
    EVP_EncryptUpdate(ctx, ciphertext, &len, plaintext, plaintext_len);
    ciphertext_len = len;
    EVP_EncryptFinal_ex(ctx, ciphertext + len, &len);
    ciphertext_len += len;
    EVP_CIPHER_CTX_free(ctx);
    
    return ciphertext_len;
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        printf("Usage: %s <input_file> <output_file>\n", argv[0]);
        return 1;
    }
    
    FILE *input = fopen(argv[1], "rb");
    if (!input) {
        perror("Error opening input file");
        return 1;
    }
    
    fseek(input, 0, SEEK_END);
    long file_size = ftell(input);
    fseek(input, 0, SEEK_SET);
    
    unsigned char *buffer = malloc(file_size);
    fread(buffer, 1, file_size, input);
    fclose(input);
    
    // Encrypt with AES-256-CBC
    unsigned char *ciphertext = malloc(file_size + AES_BLOCK_SIZE);
    int ciphertext_len = aes_encrypt(buffer, file_size, 
                                      (unsigned char*)AES_KEY, 
                                      (unsigned char*)AES_IV,
                                      ciphertext);
    
    FILE *output = fopen(argv[2], "wb");
    fwrite(ciphertext, 1, ciphertext_len, output);
    fclose(output);
    
    free(buffer);
    free(ciphertext);
    
    printf("File encrypted with AES-256-CBC\n");
    printf("Key (hex): ");
    for (int i = 0; i < 32; i++) printf("%02x", AES_KEY[i]);
    printf("\nIV (hex):  ");
    for (int i = 0; i < 16; i++) printf("%02x", AES_IV[i]);
    printf("\n");
    
    return 0;
}

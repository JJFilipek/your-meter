using System.ComponentModel.DataAnnotations;

namespace ReactApp.Server.Contracts;

public sealed class LoginRequest
{
    [Required, StringLength(80, MinimumLength = 1)]
    public required string Username { get; init; }

    [Required, StringLength(200, MinimumLength = 8)]
    public required string Password { get; init; }
}

public sealed record AuthUserDto(Guid Id, string Username, string Email);

public sealed class UpdateProfileRequest
{
    [Required, StringLength(80, MinimumLength = 3)]
    [RegularExpression("^[a-zA-Z0-9._-]+$")]
    public required string Username { get; init; }

    [Required, EmailAddress, StringLength(160)]
    public required string Email { get; init; }
}

public sealed class ChangePasswordRequest
{
    [Required, StringLength(200, MinimumLength = 8)]
    public required string CurrentPassword { get; init; }

    [Required, StringLength(200, MinimumLength = 12)]
    [RegularExpression(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
        ErrorMessage = "Nowe hasło musi zawierać małą literę, wielką literę i cyfrę.")]
    public required string NewPassword { get; init; }
}

// signup.js - Validación y manejo del formulario de registro

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('signupForm');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm_password');
  const togglePassword = document.getElementById('togglePassword');
  const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
  const signupButton = document.getElementById('signupButton');
  const spinner = document.getElementById('spinner');

  // Toggle password visibility
  togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
  });

  toggleConfirmPassword.addEventListener('click', function() {
    const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    confirmPasswordInput.setAttribute('type', type);
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
  });

  // Password strength validation
  const requirements = {
    length: { regex: /.{8,}/, element: document.getElementById('length-check') },
    uppercase: { regex: /[A-Z]/, element: document.getElementById('uppercase-check') },
    lowercase: { regex: /[a-z]/, element: document.getElementById('lowercase-check') },
    number: { regex: /[0-9]/, element: document.getElementById('number-check') },
    special: { regex: /[^A-Za-z0-9]/, element: document.getElementById('special-check') }
  };

  passwordInput.addEventListener('input', function() {
    const password = this.value;
    let allValid = true;

    for (const [key, requirement] of Object.entries(requirements)) {
      const isValid = requirement.regex.test(password);
      requirement.element.classList.toggle('valid', isValid);
      requirement.element.classList.toggle('invalid', !isValid && password.length > 0);
      
      const icon = requirement.element.querySelector('i');
      if (isValid) {
        icon.className = 'fas fa-check-circle';
      } else if (password.length > 0) {
        icon.className = 'fas fa-times-circle';
      } else {
        icon.className = 'fas fa-circle';
      }

      if (!isValid) allValid = false;
    }

    return allValid;
  });

  // Form validation
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Clear previous errors
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    let hasErrors = false;

    // Validate name
    if (!nombre || nombre.length < 2) {
      document.getElementById('nombre-error').textContent = 'El nombre debe tener al menos 2 caracteres';
      hasErrors = true;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      document.getElementById('email-error').textContent = 'Ingresa un correo electrónico válido';
      hasErrors = true;
    }

    // Validate password requirements
    let passwordValid = true;
    for (const [key, requirement] of Object.entries(requirements)) {
      if (!requirement.regex.test(password)) {
        passwordValid = false;
        break;
      }
    }

    if (!passwordValid) {
      document.getElementById('password-error').textContent = 'La contraseña no cumple con los requisitos';
      hasErrors = true;
    }

    // Validate password match
    if (password !== confirmPassword) {
      document.getElementById('confirm-password-error').textContent = 'Las contraseñas no coinciden';
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    // Show loading state
    signupButton.disabled = true;
    spinner.style.display = 'inline-block';
    document.querySelector('.button-text').style.display = 'none';

    try {
      // Submit form
      form.submit();
    } catch (error) {
      console.error('Error:', error);
      signupButton.disabled = false;
      spinner.style.display = 'none';
      document.querySelector('.button-text').style.display = 'inline';
    }
  });

  // Auto-hide alerts after 5 seconds
  setTimeout(() => {
    document.querySelectorAll('.alert').forEach(alert => {
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 300);
    });
  }, 5000);
});

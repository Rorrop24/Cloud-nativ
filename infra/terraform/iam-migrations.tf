# Conservar las direcciones del estado cuando se sigue usando el modo IAM propio.
moved {
  from = aws_iam_role.rabbitmq
  to   = aws_iam_role.rabbitmq[0]
}

moved {
  from = aws_iam_role_policy_attachment.ssm
  to   = aws_iam_role_policy_attachment.ssm[0]
}

moved {
  from = aws_iam_role_policy.secrets
  to   = aws_iam_role_policy.secrets[0]
}

moved {
  from = aws_iam_instance_profile.rabbitmq
  to   = aws_iam_instance_profile.rabbitmq[0]
}
